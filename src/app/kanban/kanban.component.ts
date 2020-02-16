import {Component, OnInit} from '@angular/core';
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
        widthBoard: '300px',
        itemHandleOptions: {enabled: false},
        addItemButton: true,
        dragBoards: true,
        dragItems: true,
        boards: columns,
        dropEl: (el, target, source, sibling) => this.onElementDropped(el, target, source, sibling),
        buttonClick: (el, boardId) => this.onTicketAdd(el, boardId),
        click: (el) => this.onTicketEdit(el)
      });
    }).catch((err) => this.throwAnError(err));
  }

  /*
  * @parameters:
  * el: the dropped ticket.
  * target: the column the ticket was dropped into
  * source: the column the ticket was in
  * siblings: other elements in the same column.
  * */
  onElementDropped(el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement): void {
    const ticketId: string = el.getAttribute('data-eid');
    const newColumn: string = target.parentElement.getAttribute('data-id');
    const oldColumn: string = source.parentElement.getAttribute('data-id');
    this.regenerateOrderOnElementDropped(newColumn, oldColumn);
  }

  /*
  * @parameters:
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
  * @parameters:
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
    this.newTicket.order = this.getTicketOrderOnElementAdded(this.newTicket.columnId);
    this.kanbanService.storeTicket(this.newTicket).then((response: ITicket) => {
      this.kanban.addElement(response.columnId, response);
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
    }).catch((err) => this.throwAnError(err));
  }


  /*
  * @parameters:
  * newColumnId: is the new column the element was dropped in
  * oldColumnId: the old column the element was in
  * */
  regenerateOrderOnElementDropped(newColumnId: string, oldColumnId: string): void {
    this.regenerateOrderOfColumn(newColumnId);

    /* when the old column is not the same as the new column
    * regenerate the order of the old column
    * */
    if (newColumnId !== oldColumnId) {
      this.regenerateOrderOfColumn(oldColumnId);
    }
  }

  /*
  * @parameters:
  * columnId: the id of the column to generate its order.
  * all elements in a column will be taken from jkanban
  * data will be extracted of all the html elements
  * batch update will occur at the end
  * */
  regenerateOrderOfColumn(columnId: string): void {
    const allEl: HTMLElement[] = this.kanban.getBoardElements(columnId);
    const tickets: Ticket[] = [];

    allEl.forEach((item, index) => {
      tickets.push(new Ticket({
        id: +item.dataset.eid, // cast id to number for update operation
        title: item.innerText,
        columnId,
        order: index
      }));
    });
    this.kanbanService.batchUpdate(tickets).catch((err) => this.throwAnError(err));
  }

  /*
  * @parameters:
  * columnId to get the length of it
  * returning the order of a newly added ticket
  * */
  getTicketOrderOnElementAdded(columnId: string): number {
    const allEl = this.kanban.getBoardElements(columnId);
    return allEl.length;
  }

  closeModal(): void {
    this.showModal = false;
  }

  throwAnError(err: any) {
    console.error('the errors is: ', err.stack || err);
  }
}
