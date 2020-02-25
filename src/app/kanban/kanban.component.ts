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

  /**
   *
   * @param kanbanService is the service which we will use to do indexed db operations
   */
  constructor(private kanbanService: KanbanService) {
    this.newTicket = new Ticket();
  }

  /**
   *
   * fetch columns from indexed db using dexie interface.
   * initialize the jkanban board.
   */
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
        dragEl: (el, source) => this.onDragElement(el, source),
        dragendEl: (el) => window.removeEventListener('mousemove', this.horizantalScroll)
      });

      // infinite scrolling
      this.columns.forEach((item: IColumn) => {
        if (item.totalTicketsLeft > 0) { // if there are still some elements in db

          // constructing the load more button
          const loadMoreButton = document.createElement('button');
          loadMoreButton.setAttribute('class', 'btn btn-success not-draggable');
          loadMoreButton.innerText = 'Load More';
          loadMoreButton.setAttribute('id', item.id);

          // once the laod more button is clicked
          loadMoreButton.addEventListener('click', (e: MouseEvent) => {
            e.preventDefault();
            const currentItems = this.kanban.getBoardElements(item.id); // button load more included

            this.kanbanService.fetchColumnWithTickets(+item.id, currentItems.length - 1).then((newColumn: IColumn) => {
              loadMoreButton.remove();
              newColumn.item.forEach((ticket: ITicket) => this.kanban.addElement(newColumn.id, ticket));
              if (newColumn.totalTicketsLeft > 0) { // if there are still elements in db after fetching the new elements
                this.kanban.addForm(newColumn.id, loadMoreButton);
              }
            });

          });
          this.kanban.addForm(item.id, loadMoreButton);
        }
      });
    }).catch((err) => this.throwAnError(err));
  }

  /**
   *
   * @param event
   */
  horizantalScroll(event): void {
    const edgeSize = 50;
    const viewportX = event.clientX;
    const viewportWidth = document.documentElement.clientWidth;
    const edgeLeft = edgeSize;
    const edgeRight = (viewportWidth - edgeSize);
    const isInLeftEdge = (viewportX < edgeLeft);
    const isInRightEdge = (viewportX > edgeRight);

    if (!(isInLeftEdge || isInRightEdge)) {
      return;
    }

    const documentWidth = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.body.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.body.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    );

    const maxScrollX = (documentWidth - viewportWidth);

    const currentScrollX = window.pageXOffset;

    const canScrollLeft = (currentScrollX > 0);
    const canScrollRight = (currentScrollX < maxScrollX);

    let nextScrollX = currentScrollX;

    const maxStep = 50;

    if (isInLeftEdge && canScrollLeft) {

      const intensity = ((edgeLeft - viewportX) / edgeSize);

      nextScrollX = (nextScrollX - (maxStep * intensity));

      // Should we scroll right?
    } else if (isInRightEdge && canScrollRight) {

      const intensity = ((viewportX - edgeRight) / edgeSize);

      nextScrollX = (nextScrollX + (maxStep * intensity));

    }

    nextScrollX = Math.max(0, Math.min(maxScrollX, nextScrollX));

    if (nextScrollX !== currentScrollX) {
      window.scrollTo({left: nextScrollX});
    }
  }

  /**
   *
   * @param el the dragged element
   * @param source where the element was dragged from
   */
  onDragElement(el: HTMLElement, source: HTMLElement) {
    const columnId = source.parentElement.getAttribute('data-id');

    const id = el.dataset.eid;
    this.draggedElement = new Ticket({
      id,
      title: el.innerText,
      columnId,
      order: this.getOrderOfAnElementInBoard(columnId, id)
    });

    window.addEventListener('mousemove', this.horizantalScroll, false);
  }

  /**
   *
   * @param el the dropped ticket.
   * @param target the column the ticket was dropped into
   * @param source the column the ticket was in
   * @param sibling other elements in the same column.
   */
  onElementDropped(el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement): void {
    const ticketId: string = el.getAttribute('data-eid');
    const newColumn: string = target.parentElement.getAttribute('data-id');
    const oldColumn: string = source.parentElement.getAttribute('data-id');
    const ord: number = this.getOrderOfAnElementInBoard(newColumn, ticketId);

    const ticket = new Ticket({
      id: +ticketId,
      columnId: +newColumn,
      order: ord,
      title: el.innerText
    });

    this.kanbanService.updateTicket(ticket).then((updatedTicket: ITicket) => {
      this.kanbanService.regenerateByIncrement(+newColumn, updatedTicket).then(async () => {
        if (oldColumn !== newColumn) {
          await this.kanbanService.regenerateByDecrement(+oldColumn, this.draggedElement);
        }
      });
    });
  }

  /**
   *
   * this method will show the modal, and assign whichModal a value.
   * @param el the clicked html button.
   * @param columnId location of the clicked button.
   */
  onTicketAdd(el: HTMLElement, columnId: string): void {
    this.newTicket = new Ticket();
    this.newTicket.columnId = columnId;
    this.whichModal = 'add';
    this.showModal = true;
  }

  /**
   *
   * fetch the clicked ticket data from indexed db and assign it to the newTicket.
   * show the modal and assign whichModal a value.
   * show the modal and assign whichModal a value.
   * @param el the clicked html ticket.
   */
  onTicketEdit(el: HTMLElement): void {
    const ticketId = el.getAttribute('data-eid');
    this.kanbanService.fetchTicket(ticketId).then((response: ITicket) => {
      this.newTicket = response;
      this.whichModal = 'edit';
      this.showModal = true;
    });
  }

  /**
   *
   * checks which modal is currently opened, and call the needed function.
   */
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
  *
  * adds a new ticket to indexed db.
  * adds a new ticket to the kanban board.
  * */
  addTicket(): void {
    const existingLoadMoreButton = document.getElementById(this.newTicket.columnId);
    this.newTicket.order = this.getTicketOrderOnElementAdded(this.newTicket.columnId);
    if (existingLoadMoreButton) {
      this.newTicket.order -= 1;
    }
    this.kanbanService.storeTicket(this.newTicket).then(async (response: ITicket) => {
      if (existingLoadMoreButton) {
        existingLoadMoreButton.remove();
      }
      this.kanban.addElement(response.columnId, response);
      if (existingLoadMoreButton) {
        this.kanban.addForm(this.newTicket.columnId, existingLoadMoreButton);
      }
      await this.kanbanService.regenerateByIncrement(this.newTicket.columnId, this.newTicket);
      this.closeModal();
    }).catch((err) => this.throwAnError(err));
  }

  /*
  *
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
  *
  * removes a ticket from indexed db.
  * removes a ticket from the kanban board.
  * */
  removeTicket(): void {
    this.kanbanService.destroyElement(this.newTicket.id).then((id: number) => {
      this.showModal = false;
      this.kanban.removeElement(id);
      this.kanbanService.regenerateByDecrement(+this.newTicket.columnId, this.newTicket);
    }).catch((err) => this.throwAnError(err));
  }

  /**
   *
   * @param columnId to get the length of it
   * @return the order of a newly added ticket
   */
  getTicketOrderOnElementAdded(columnId: string): number {
    const allEl = this.kanban.getBoardElements(columnId);
    return allEl.length;
  }

  /**
   *
   * @param columnId the column which the element exists in
   * @param elementId the id of the element to get the order of
   */
  getOrderOfAnElementInBoard(columnId: string, elementId: string): number {
    let order = 0;
    const allEl: HTMLElement[] = this.kanban.getBoardElements(columnId);
    allEl.forEach((item: HTMLElement, index: number) => {
      if (item.dataset.eid === elementId) {
        order = index;
      }
    });
    return order;
  }

  /**
   *
   * @param event
   */
  onImageSelected(event) {
    const file = event.target.files[0];
    if (file) {
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = (e) => {
        // @ts-ignore
        this.newTicket.image = e.target.result;
      };
    }
  }

  /**
   *
   * @param err the error to be thrown
   */
  throwAnError(err: any) {
    console.error('the errors is: ', err.stack || err);
  }

  closeModal(): void {
    this.showModal = false;
  }
}
