import {Component, ElementRef, HostListener, OnInit} from '@angular/core';
import {jKanban} from 'jkanban';
import {KanbanService} from './kanban.service';
import {ITicket} from './interfaces/ticket.interface';
import {IColumn} from './interfaces/column.interface';
import {Ticket} from './ticket.module';

declare const jKanban: any;

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.css'],
  providers: [KanbanService]
})

export class KanbanComponent implements OnInit {
  kanban: any;
  whichModal: string;
  showModal = false;
  deleteClicked: boolean;
  addClicked: boolean;
  newTicket: ITicket;
  columns: IColumn[] = [];
  draggedElement: ITicket;
  loadMoreButton: HTMLElement;

  constructor(private kanbanService: KanbanService) {
    this.newTicket = new Ticket();
  }

  /*
  * fetch columns from indexed db using dexie interface.
  * order items on load.
  * initialize the jkanban board.
  * */
  ngOnInit(): void {
    this.kanbanService.fetchColumns().then((columns: IColumn[]) => {
      this.columns = columns;

      this.kanban = new jKanban({
        element: '#kanban',
        gutter: '10px',
        widthBoard: '400px',
        itemHandleOptions: {enabled: false},
        addItemButton: true,
        dragBoards: true,
        dragItems: true,
        boards: columns,
        dropEl: (el, target, source, sibling) => this.onElementDropped(el, target, source, sibling),
        buttonClick: (el, boardId) => this.onTicketAdd(el, boardId),
        click: (el) => this.onTicketEdit(el),
        dragEl: (el, source) => {
          const columnId = source.parentElement.getAttribute('data-id');
          const id = el.dataset.eid;

          this.draggedElement = new Ticket({
            id,
            title: el.innerText,
            columnId,
            order: this.getOrderOfAnElementInBoard(columnId, id)
          });
        }
      });

      this.loadMoreButton = document.createElement('button');
      this.loadMoreButton.setAttribute('class', 'btn btn-success not-draggable');
      this.loadMoreButton.innerText = 'Load More';

      // infinite scrolling
      this.columns.forEach((item: IColumn) => {
        if (item.totalTicketsLeft > 0) {
          this.loadMoreButton.setAttribute('id', item.id);

          this.kanban.addForm(item.id, this.loadMoreButton);
          this.loadMoreButton.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            const currentItems = this.kanban.getBoardElements(item.id); // button load more included
            this.kanbanService.fetchColumnWithTickets(+item.id, currentItems.length - 1).then((newColumn: IColumn) => {
              this.loadMoreButton.remove();
              newColumn.item.forEach((ticket: ITicket) => this.kanban.addElement(newColumn.id, ticket));
              if (newColumn.totalTicketsLeft > 0) {
                this.kanban.addForm(this.loadMoreButton);
              }
            });
          });
        }
      });
    }).catch((err) => this.throwAnError(err));
  }

  /*
  * @param
  * el: the dropped ticket.
  * target: the column the ticket was dropped into
  * source: the column the ticket was in
  * siblings: other elements in the same column.
  * */
  onElementDropped(el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement): void {
    const ticketId: string = el.getAttribute('data-eid');
    const newColumn: string = target.parentElement.getAttribute('data-id');
    const oldColumn: string = source.parentElement.getAttribute('data-id');
    const ord = this.getOrderOfAnElementInBoard(newColumn, ticketId);

    const ticket = new Ticket({
      id: +ticketId,
      columnId: +newColumn,
      order: ord,
      title: el.innerText
    });

    this.kanbanService.updateTicket(ticket).then((updatedTicket: ITicket) => {
      this.kanbanService.regenerateByIncrement(+newColumn, updatedTicket).then(() => {
        if (oldColumn !== newColumn) {
          this.kanbanService.regenerateByDecrement(+oldColumn, this.draggedElement);
        }
      });
    });
  }

  /*
  * @param
  * el: the clicked html button.
  * columnId: location of the clicked button.
  * this method will show the modal, and assign whichModal a value.
  * */
  onTicketAdd(el: HTMLElement, columnId: string): void {
    this.newTicket = new Ticket();
    this.newTicket.columnId = columnId;
    this.whichModal = 'add';
    this.showModal = true;
  }

  /*
  * @param
  * el: the clicked html ticket.
  * fetch the clicked ticket data from indexed db and assign it to the newTicket.
  * show the modal and assign whichModal a value.
  * */
  onTicketEdit(el: HTMLElement): void {
    const ticketId = el.getAttribute('data-eid');
    this.kanbanService.fetchTicket(ticketId).then((response: ITicket) => {
      this.newTicket = response;
      this.whichModal = 'edit';
      this.showModal = true;
    });
  }

  /*
  * checks which modal is currently opened,
  * and execute the needed operation.
  * */
  addTicketOrUpdateTicket(): void {
    this.addClicked = true;
    if (this.whichModal === 'add') {
      this.addTicket();
    } else if (this.whichModal === 'edit') {
      this.updateTicket();
    }
    this.addClicked = false;
  }

  /*
  * adds a new ticket to indexed db.
  * adds a new ticket to the kanban board.
  * */
  addTicket(): void {
    const existingLoadMoreButton = document.getElementById(this.newTicket.columnId);
    this.newTicket.order = this.getTicketOrderOnElementAdded(this.newTicket.columnId);
    this.kanbanService.storeTicket(this.newTicket).then((response: ITicket) => {
      if (existingLoadMoreButton) {
        existingLoadMoreButton.remove();
      }
      this.kanban.addElement(response.columnId, response);
      if (existingLoadMoreButton) {
        this.kanban.addForm(this.newTicket.columnId, existingLoadMoreButton);
      }
      this.closeModal();
    }).catch((err) => this.throwAnError(err));
  }

  /*
  * updates ticket in indexed db.
  * updates ticket in the kanban board.
  * */
  updateTicket(): void {
    const oldColumnId = this.kanban.getParentBoardID(this.newTicket.id);
    if (oldColumnId !== this.newTicket.columnId) {
      // get the order of the element in the new board
      this.newTicket.order = this.getTicketOrderOnElementAdded(this.newTicket.columnId);
    }
    this.kanbanService.updateTicket(this.newTicket)
      .then((ticket: ITicket) => {
        if (oldColumnId !== ticket.columnId) {
          this.kanban.removeElement(ticket.id);
          this.kanban.addElement(ticket.columnId, ticket);
        } else {
          this.kanban.replaceElement(ticket.id, ticket);
        }
        this.closeModal();
      }).catch((err) => this.throwAnError(err));
  }

  /*
  * removes a ticket from indexed db.
  * removes a ticket from the kanban board.
  * */
  removeTicket(): void {
    this.kanbanService.destroyElement(this.newTicket.id).then((id: number) => {
      this.showModal = false;
      this.kanban.removeElement(id);
      console.log(this.newTicket);
      this.kanbanService.regenerateByDecrement(+this.newTicket.columnId, this.newTicket);
    }).catch((err) => this.throwAnError(err));
  }

  /*
  * @param
  * columnId to get the length of it
  * returning the order of a newly added ticket
  */
  getTicketOrderOnElementAdded(columnId: string): number {
    const allEl = this.kanban.getBoardElements(columnId);
    return allEl.length;
  }

  getOrderOfAnElementInBoard(columnId: string, id: string): number {
    let order = 0;
    const allEl: HTMLElement[] = this.kanban.getBoardElements(columnId);
    allEl.forEach((item: HTMLElement, index: number) => {
      if (item.dataset.eid === id) {
        order = index;
      }
    });
    return order;
  }

  closeModal(): void {
    this.showModal = false;
  }

  onImageSelected(event) {
    const file = event.target.files[0];
    if (file) {
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      console.log({fileReader});
      fileReader.onload = (e) => {
        // @ts-ignore
        this.newTicket.image = e.target.result;
      };
    }
  }

  throwAnError(err: any) {
    console.error('the errors is: ', err.stack || err);
  }
}
